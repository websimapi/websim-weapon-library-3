function adjustColor(color, percent) {
  if (!color) return '#ffffff';
  
  // Handle named colors by converting to hex
  const namedColors = {
    white: '#ffffff',
    black: '#000000'
    // Add other common colors as needed
  };
  
  if (namedColors[color.toLowerCase()]) {
    color = namedColors[color.toLowerCase()];
  }

  // If color doesn't start with #, return white
  if (!color.startsWith('#')) return '#ffffff';

  try {
    const num = parseInt(color.replace('#', ''), 16),
          amt = Math.round(2.55 * percent),
          R = Math.min(255, Math.max(0, (num >> 16) + amt)),
          G = Math.min(255, Math.max(0, (num >> 8 & 0x00FF) + amt)),
          B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
    return '#' + (0x1000000 + (R * 0x10000) + (G * 0x100) + B).toString(16).slice(1);
  } catch (e) {
    console.error('Error adjusting color:', e);
    return '#ffffff';
  }
}

const room = new WebsimSocket();

async function generateWeapon() {
  const weaponName = document.getElementById('weaponName').value;
  const weaponDescription = document.getElementById('weaponDescription').value || '';
  const weaponContext = document.getElementById('weaponContext').value || '';
  const weaponType = document.getElementById('weaponType').value;
  const optionalType1 = document.getElementById('optionalWeaponType1').value;
  const optionalType2 = document.getElementById('optionalWeaponType2').value;
  const weaponElement = document.getElementById('weaponElement').value;
  const optionalElement1 = document.getElementById('optionalElement1').value;
  const optionalElement2 = document.getElementById('optionalElement2').value;
  const weaponRarity = document.getElementById('weaponRarity').value;
  const allTypes = [weaponType, optionalType1, optionalType2].filter(t => t).join(' + ');
  const allElements = [weaponElement, optionalElement1, optionalElement2].filter(e => e).join(' + ');

  if (!weaponName) {
    alert('Please provide a name for your weapon!');
    return;
  }

  document.getElementById('loading').style.display = 'block';

  try {
    const completion = await websim.chat.completions.create({
      messages: [
        {
          role: "user", 
          content: `Generate detailed weapon stats for a ${allTypes} weapon named "${weaponName}"
            ${weaponDescription ? ` with the following description: ${weaponDescription}` : ''}
            ${allElements ? ` with ${allElements} element` : ''}
            ${weaponRarity ? ` with ${weaponRarity} rarity` : ''}
            ${weaponContext ? `\nAdditional context: ${weaponContext}` : ''}.
            Include damage, element (${allElements ? `must be ${allElements}` : `from: None, Fire, Ice, Water, Plant, Electric, Darkness, Light, Earth, Wind, Noble, Poison, Cute, Undead, Arcane, Transformation, Reality, Spirit, Inanimate, Metal, Animal`}), 
            regular attack (REQUIRED for ALL weapons), passive effects (only for Uncommon+ weapons), appearance, rarity (${weaponRarity ? `must be exactly ${weaponRarity}` : 'from: Common, Uncommon, Rare, Epic, Super-Epic, Legendary, Mythical, Transcendent'}), price in gold, and a short, impactful flavor blurb.
            The weapon's name and abilities should be thematically aligned with the provided description if one was given.
            The flavor blurb should be a brief, memorable line focused on the weapon's characteristics - its element, appearance, function and overall theme - rather than its specific name. Make it charming, funny, somber, or empowering based on these traits.${weaponContext ? '\nEnsure the weapon aligns with the provided context.' : ''}
            
            ${weaponRarity ? 'Important: The rarity MUST be exactly ' + weaponRarity : ''}
            ${allElements ? 'Important: The element(s) MUST be exactly ' + allElements : ''}
            
            Respond directly with JSON, following this JSON schema, and no other text:
            {
                "damage": number,
                "element": string,
                "specialAbility": string,  // Regular attack for ALL rarities
                "passiveEffects": string,
                "appearance": string,
                "rarity": string,
                "price": number,
                "flavorBlurb": string
            }`
        }
      ],
      json: true
    });

    const weaponStats = JSON.parse(completion.content);
    const isPrivate = document.getElementById('weaponPrivacy').checked;

    await room.collection('weapons').create({
      name: weaponName,
      description: weaponDescription,
      context: weaponContext,
      isPrivate,
      creatorId: room.party.client.id,
      ...weaponStats
    });

    document.getElementById('weaponName').value = '';
    document.getElementById('weaponDescription').value = '';
    document.getElementById('weaponContext').value = '';
  } catch (error) {
    console.error('Error:', error);
    alert(error.message || 'Failed to generate weapon. Please try again.');
  } finally {
    document.getElementById('loading').style.display = 'none';
  }
}

room.collection('weapons').subscribe(weapons => {
  displayWeapons(weapons);
  
  // Update battle logs for displayed weapon
  const selectedWeapon = document.getElementById('selectedWeapon');
  if (selectedWeapon && selectedWeapon.children.length) {
    const weaponCard = selectedWeapon.children[0];
    const weaponId = weaponCard.dataset.weaponId;
    if (weaponId) {
      updateWeaponBattleLogs(weaponId);
    }
  }
});

function createWeaponCard(weapon, detailed = false) {
  let html = `
    <h3>${weapon.name}</h3>
    <div class="flavor-blurb">${weapon.flavorBlurb}</div>
    ${weapon.description ? `<p>Description: ${weapon.description}</p>` : ''}
    <p>Damage: <span class="number">${weapon.damage}</span></p>
    <p class="rarity-${weapon.rarity}">Rarity: ${weapon.rarity}</p>
    <p>Price: <span class="number">${weapon.price}</span> gold</p>
    <p class="element-${weapon.element}">Element: ${getElementEmoji(weapon.element)} ${weapon.element}</p>
    <p>Appearance: ${weapon.appearance}</p>
    <p>Regular Attack: ${weapon.specialAbility}</p>
  `;
  
  if (weapon.rarity !== 'Common' && weapon.passiveEffects) {
    html += `<p>Passive: ${weapon.passiveEffects}</p>`;
  }

  if (weapon.additionalAbilities) {
    weapon.additionalAbilities.forEach(ability => {
      html += `<p>Additional Ability: ${ability}</p>`;
    });
  }

  if (weapon.specialZones) {
    weapon.specialZones.forEach(zone => {
      html += `<p>Special Zone: ${zone}</p>`;
    });
  }

  if (weapon.uniqueTraits) {
    weapon.uniqueTraits.forEach(trait => {
      html += `<p>Unique Trait: ${trait}</p>`;
    });
  }

  html += `
    <button class="edit-btn" onclick="editWeapon('${weapon.id}')">✎</button>
    <button class="download-btn" onclick="downloadWeapon('${weapon.id}')">⭳</button>
    <button class="delete-btn" onclick="deleteWeapon('${weapon.id}')">×</button>
    <div class="battle-logs-header" onclick="toggleBattleLogs('${weapon.id}')">
      <span class="toggle-icon">▼</span>
      <h4>Battle History</h4>
      <span class="battle-count">${weapon.battleLogs?.length || 0} battles</span>
    </div>
    <div class="battle-logs-content" id="battle-logs-${weapon.id}">
      <div class="battle-logs-list">
        ${weapon.battleLogs ? weapon.battleLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map(log => `
          <div class="weapon-battle-log">
            <div class="battle-outcome ${log.winner === weapon.name ? 'victory' : 'defeat'}">
              ${log.winner === weapon.name ? 'Victory' : 'Defeat'} at ${log.location} (${log.goreLevel})
            </div>
            <div class="battle-description">${log.description}</div>
            <div class="battle-details">
              <small>${new Date(log.timestamp).toLocaleString()}</small>
            </div>
          </div>
        `).join('') : '<p>No battles recorded yet.</p>'}
      </div>
    </div>
  `;
  if (weapon.rarity === 'Transcendent') {
    const elementColors = {
      'None': '#ffffff',
      'Fire': '#ff4444',
      'Ice': '#00ffff', 
      'Water': '#4444ff',
      'Plant': '#44ff44',
      'Electric': '#ffff44',
      'Darkness': '#4b0082',
      'Light': '#ffff80',
      'Earth': '#8b4513',
      'Wind': '#008080',
      'Poison': '#800080',
      'Cute': '#FFB6C1',
      'Noble': '#9370DB',
      'Undead': '#808000',
      'Arcane': '#8B008B',
      'Transformation': '#B8860B',
      'Reality': '#FF1493',
      'Spirit': '#98FB98',
      'Inanimate': '#00008B',
      'Metal': '#4A4A4A',
      'Animal': '#654321'
    };

    // Add custom element colors
    const customElements = {};
    room.collection('elements').getList().forEach(elem => {
      elementColors[elem.name] = elem.color;
      const styleSheet = document.createElement('style');
      styleSheet.textContent = `.element-${elem.name} { color: ${elem.color}; }`;
      document.head.appendChild(styleSheet);
    });

    const elements = [weapon.element].concat(weapon.optionalElement1 || [], weapon.optionalElement2 || []).filter(Boolean);
    
    let gradient, color;
    if (elements.length > 0) {
      const colors = elements.map(e => elementColors[e] || '#ffffff');
      gradient = colors.length === 1 
        ? `linear-gradient(45deg, ${colors[0]}, ${colors[0]})`
        : `linear-gradient(45deg, ${colors.join(', ')})`;
      color = colors[0];
    } else {
      gradient = 'linear-gradient(45deg, #ffffff, #ffffff)';
      color = '#ffffff';
    }

    const cardStyle = document.createElement('style');
    cardStyle.textContent = `
      .weapon-card.rarity-Transcendent[data-weapon-id="${weapon.id}"],
      .weapon-list-item.rarity-Transcendent[data-weapon-id="${weapon.id}"] {
        --transcendent-gradient: ${gradient};
        --transcendent-color: ${color};
        --transcendent-glow: rgba(255,255,255,0.4);
      }
    `;
    document.head.appendChild(cardStyle);
  }

  return html;
}

room.collection('weapons').subscribe(weapons => {
  displayWeapons(weapons);
  
  // Update battle logs for displayed weapon
  const selectedWeapon = document.getElementById('selectedWeapon');
  if (selectedWeapon && selectedWeapon.children.length) {
    const weaponCard = selectedWeapon.children[0];
    const weaponId = weaponCard.dataset.weaponId;
    if (weaponId) {
      updateWeaponBattleLogs(weaponId);
    }
  }
});

function displayWeapons(weapons) {
  const library = document.getElementById('weaponLibrary');
  library.innerHTML = '';
  let visibleWeapons = weapons.filter(weapon => {
    return !weapon.isPrivate || weapon.creatorId === room.party.client.id;
  });
  const searchText = document.getElementById('weaponSearch')?.value.toLowerCase();
  if (searchText) {
    visibleWeapons = visibleWeapons.filter(weapon => {
      return weapon?.name?.toLowerCase().includes(searchText) || weapon?.description?.toLowerCase().includes(searchText) || weapon?.element?.toLowerCase().includes(searchText) || weapon?.rarity?.toLowerCase().includes(searchText) || weapon?.passiveEffects?.toLowerCase().includes(searchText) || weapon?.specialAbility?.toLowerCase().includes(searchText) || weapon?.appearance?.toLowerCase().includes(searchText) || weapon?.flavorBlurb?.toLowerCase().includes(searchText) || weapon?.additionalAbilities?.some(ability => ability.toLowerCase().includes(searchText)) || weapon?.specialZones?.some(zone => zone.toLowerCase().includes(searchText)) || weapon?.uniqueTraits?.some(trait => trait.toLowerCase().includes(searchText));
    });
  }
  const sortBy = document.getElementById('sortBy')?.value;
  const rarityOrder = {
    'Common': 0,
    'Uncommon': 1,
    'Rare': 2,
    'Epic': 3,
    'Super-Epic': 4,
    'Legendary': 5,
    'Mythical': 6,
    'Transcendent': 7
  };
  visibleWeapons.sort((a, b) => {
    switch (sortBy) {
      case 'rarity-desc':
        return (rarityOrder[b?.rarity || 'Common'] || 0) - (rarityOrder[a?.rarity || 'Common'] || 0);
      case 'rarity-asc':
        return (rarityOrder[a?.rarity || 'Common'] || 0) - (rarityOrder[b?.rarity || 'Common'] || 0);
      case 'name':
        return (a?.name || '').localeCompare(b?.name || '');
      case 'name-desc':
        return (b?.name || '').localeCompare(a?.name || '');
      case 'newest':
        return new Date(b?.created_at || 0) - new Date(a?.created_at || 0);
      case 'oldest':
        return new Date(a?.created_at || 0) - new Date(b?.created_at || 0);
      case 'damage-desc':
        return (b?.damage || 0) - (a?.damage || 0);
      case 'damage-asc':
        return (a?.damage || 0) - (b?.damage || 0);
      default:
        const rarityDiff = (rarityOrder[b?.rarity || 'Common'] || 0) - (rarityOrder[a?.rarity || 'Common'] || 0);
        if (rarityDiff === 0) {
          return new Date(b?.created_at || 0) - new Date(a?.created_at || 0);
        }
        return rarityDiff;
    }
  });
  visibleWeapons.forEach(weapon => {
    if (weapon.rarity === 'Transcendent') {
      const elementColors = {
        'None': '#ffffff',
        'Fire': '#ff4444',
        'Ice': '#00ffff', 
        'Water': '#4444ff',
        'Plant': '#44ff44',
        'Electric': '#ffff44',
        'Darkness': '#4b0082',
        'Light': '#ffff80',
        'Earth': '#8b4513',
        'Wind': '#008080',
        'Poison': '#800080',
        'Cute': '#FFB6C1',
        'Noble': '#9370DB',
        'Undead': '#808000',
        'Arcane': '#8B008B',
        'Transformation': '#B8860B',
        'Reality': '#FF1493',
        'Spirit': '#98FB98',
        'Inanimate': '#00008B',
        'Metal': '#4A4A4A',
        'Animal': '#654321'
      };

      // Add custom element colors
      room.collection('elements').getList().forEach(elem => {
        elementColors[elem.name] = elem.color;
      });

      const elements = [weapon.element].concat(weapon.optionalElement1 || [], weapon.optionalElement2 || []).filter(Boolean);
      
      let gradient, color;
      if (elements.length > 0) {
        const colors = elements.map(e => elementColors[e] || '#ffffff');
        gradient = colors.length === 1 
          ? `linear-gradient(45deg, ${colors[0]}, ${colors[0]})`
          : `linear-gradient(45deg, ${colors.join(', ')})`;
        color = colors[0];
      } else {
        gradient = 'linear-gradient(45deg, #ffffff, #ffffff)';
        color = '#ffffff';
      }

      const cardStyle = document.createElement('style');
      cardStyle.textContent = `
        .weapon-card.rarity-Transcendent[data-weapon-id="${weapon.id}"],
        .weapon-list-item.rarity-Transcendent[data-weapon-id="${weapon.id}"] {
          --transcendent-gradient: ${gradient};
          --transcendent-color: ${color};
          --transcendent-glow: rgba(255,255,255,0.4);
        }
      `;
      document.head.appendChild(cardStyle);
    }

    const item = document.createElement('div');
    item.className = `weapon-list-item rarity-${weapon?.rarity || 'Common'}`;
    item.dataset.weaponId = weapon.id;
    if (weapon.isPrivate) {
      item.classList.add('private');
    }
    item.textContent = weapon?.name || 'Unnamed Weapon';
    item.onclick = () => {
      const selectedSection = document.getElementById('selectedWeapon');
      const detailedCard = document.createElement('div');
      detailedCard.className = `weapon-card rarity-${weapon?.rarity || 'Common'}`;
      detailedCard.innerHTML = createWeaponCard(weapon, true);
      detailedCard.dataset.weaponId = weapon.id;
      selectedSection.innerHTML = '';
      selectedSection.appendChild(detailedCard);
    };
    library.appendChild(item);
  });
}

async function startBattle() {
  const weapon1Id = document.getElementById('weapon1').value;
  const weapon2Id = document.getElementById('weapon2').value;
  const goreLevel = document.getElementById('goreIntensity').value;
  const location = document.getElementById('battleLocation').value || 'Arena';
  if (!weapon1Id || !weapon2Id) {
    alert('Please select two weapons!');
    return;
  }
  document.getElementById('battleLoading').style.display = 'block';
  document.getElementById('winnerAnnouncement').style.display = 'none';
  const revealBtn = document.createElement('button');
  revealBtn.className = 'reveal-winner-btn';
  revealBtn.textContent = 'Reveal Outcome';
  const weapons = room.collection('weapons').getList();
  const weapon1 = weapons.find(w => w.id === weapon1Id);
  const weapon2 = weapons.find(w => w.id === weapon2Id);
  const colorize = (text, weapons) => {
    let colorized = text;
    weapons.forEach(weapon => {
      const regex = new