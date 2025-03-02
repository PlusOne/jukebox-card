class JukeboxCard extends HTMLElement {
    set hass(hass) {
        if (!this.content) {
            this._hassObservers = [];
            this.appendChild(getStyle());
            const card = document.createElement('ha-card');
            this.content = document.createElement('div');
            card.appendChild(this.content);
            this.appendChild(card);

            this.content.appendChild(this.buildSpeakerSwitches(hass));
            this.content.appendChild(this.buildVolumeSlider());
            this.content.appendChild(this.buildStationList());
        }

        this._hass = hass;
        this._hassObservers.forEach(listener => listener(hass));
    }

    get hass() {
        return this._hass;
    }

    buildSpeakerSwitches(hass) {
        this._tabs = document.createElement('paper-tabs');
        this._tabs.setAttribute('scrollable', true);
        this._tabs.addEventListener('iron-activate', (e) => this.onSpeakerSelect(e.detail.item.entityId));

        this.config.entities.forEach(entityId => {
            if (!hass.states[entityId]) {
                console.log('Jukebox: No State for entity', entityId);
                return;
            }
            this._tabs.appendChild(this.buildSpeakerSwitch(entityId, hass));
        });

        // automatically activate the first speaker that's playing
        const firstPlayingSpeakerIndex = this.findFirstPlayingIndex(hass);
        this._selectedSpeaker = this.config.entities[firstPlayingSpeakerIndex];
        this._tabs.setAttribute('selected', firstPlayingSpeakerIndex);

        return this._tabs;
    }

    buildStationList() {
        this._stationButtons = [];

        const stationList = document.createElement('div');
        stationList.classList.add('station-list');

        this.config.links.forEach(linkCfg => {
            const stationButton = this.buildStationSwitch(linkCfg.name, linkCfg.url)
            this._stationButtons.push(stationButton);
            stationList.appendChild(stationButton);
        });

        // make sure the update method is notified of a change
        this._hassObservers.push(this.updateStationSwitchStates.bind(this));

        return stationList;
    }

    buildVolumeSlider() {
        const volumeContainer = document.createElement('div');
        volumeContainer.className = 'volume center horizontal layout';

        const muteButton = document.createElement('paper-icon-button');
        muteButton.setAttribute('icon', 'hass:volume-high');
        muteButton.isMute = false;
        muteButton.addEventListener('click', this.onMuteUnmute.bind(this));

        const slider = document.createElement('ha-paper-slider');
        slider.min = 0;
        slider.max = 100;
        slider.addEventListener('change', this.onChangeVolumeSlider.bind(this));
        slider.className = 'flex';

        const stopButton = document.createElement('paper-icon-button');
        stopButton.setAttribute('icon', 'hass:stop');
        stopButton.setAttribute('disabled', true);
        stopButton.addEventListener('click', this.onStop.bind(this));

        volumeContainer.appendChild(muteButton);
        volumeContainer.appendChild(slider);
        volumeContainer.appendChild(stopButton);
        // Removed sleep button from here
        // Append the extra sleep timer row after volume controls
        volumeContainer.appendChild(this.buildSleepTimerRow());

        this._hassObservers.push(hass => {
            if (!this._selectedSpeaker) {
                 console.error('(DEBUG) no _selectedSpeaker defined');
                 return;
            }
            const state = hass.states[this._selectedSpeaker];
            if (!state) {
                 console.warn('(DEBUG) no state found for', this._selectedSpeaker);
                 // Use fallback defaults for volume controls
                 slider.value = 50;
                 stopButton.setAttribute('disabled', true);
                 muteButton.setAttribute('icon', 'hass:volume-high');
                 return;
            }
            const speakerState = state.attributes;
            // Always show controls
            slider.removeAttribute('hidden');
            stopButton.removeAttribute('hidden');
            muteButton.removeAttribute('hidden');
            const volLevel = speakerState.hasOwnProperty('volume_level') ? speakerState.volume_level : 0;
            slider.value = volLevel * 100;
            if (state.state === 'playing') {
                 stopButton.removeAttribute('disabled');
            } else {
                 stopButton.setAttribute('disabled', true);
            }
            const isMuted = speakerState.hasOwnProperty('is_volume_muted') ? speakerState.is_volume_muted : false;
            if (isMuted) {
                  slider.disabled = true;
                  muteButton.setAttribute('icon', 'hass:volume-off');
                  muteButton.isMute = true;
             } else {
                  slider.disabled = false;
                  muteButton.setAttribute('icon', 'hass:volume-high');
                  muteButton.isMute = false;
             }
        });

        return volumeContainer;
    }

    buildSleepTimerRow() {
        const sleepContainer = document.createElement('div');
        sleepContainer.className = 'sleep-timer center horizontal layout';
        
        // Slider for setting sleep time in minutes
        const sleepSlider = document.createElement('ha-paper-slider');
        sleepSlider.min = 0;
        sleepSlider.max = 120; // e.g. 0 to 120 minutes
        sleepSlider.value = 5; // default value
        sleepSlider.addEventListener('change', (e) => {
            // Support different event objects across browsers
            this._sleepMinutes = parseInt(e.detail?.value || e.target.value, 10) || 5;
        });
        sleepSlider.className = 'flex';

        // Button to enable sleep timer with set minutes
        const sleepSetButton = document.createElement('paper-icon-button');
        sleepSetButton.setAttribute('icon', 'hass:timer');
        sleepSetButton.addEventListener('click', () => {
            const minutes = this._sleepMinutes || 5;
            console.log(`Setting sleep timer for ${minutes} minutes on entity: ${this._selectedSpeaker}`);
            setTimeout(() => {
                console.log('Sleep timer fired. Stopping media on:', this._selectedSpeaker);
                this.hass.callService('media_player', 'media_stop', {
                    entity_id: this._selectedSpeaker
                });
            }, minutes * 60000);
        });
        
        sleepContainer.appendChild(sleepSlider);
        sleepContainer.appendChild(sleepSetButton);
        return sleepContainer;
    }

    onSpeakerSelect(entityId) {
        this._selectedSpeaker = entityId;
        this._hassObservers.forEach(listener => listener(this.hass));
    }

    onChangeVolumeSlider(e) {
        const volPercentage = parseFloat(e.currentTarget.value);
        const vol = (volPercentage > 0 ? volPercentage / 100 : 0);
        this.setVolume(vol);
    }

    onMuteUnmute(e) {
        this.hass.callService('media_player', 'volume_mute', {
            entity_id: this._selectedSpeaker,
            is_volume_muted: !e.currentTarget.isMute
        });
    }

    onStop(e) {
        this.hass.callService('media_player', 'media_stop', {
            entity_id: this._selectedSpeaker
        });
    }

    onSleep() {
        const input = prompt('Enter sleep time in minutes:', '5');
        if (!input) return;
        const minutes = parseInt(input, 10);
        if (isNaN(minutes) || minutes <= 0) {
            alert('Please enter a valid positive integer.');
            return;
        }
        // Preserve current selected speaker with a fallback default
        const entity = this._selectedSpeaker || 'media_player.default';
        console.log(`(DEBUG) sleep timer set for ${minutes} minutes on: ${entity}`);
        setTimeout(() => {
            console.log(`(DEBUG) sleep timer fired for entity: ${entity}`);
            this.hass.callService('media_player', 'media_stop', {
                entity_id: entity
            }).catch(err => console.error('(DEBUG) media_stop service call failed:', err));
        }, minutes * 60000);
    }

    updateStationSwitchStates(hass) {
        let playingUrl = null;
        const selectedSpeaker = this._selectedSpeaker;

        if (hass.states[selectedSpeaker] && hass.states[selectedSpeaker].state === 'playing') {
            playingUrl = hass.states[selectedSpeaker].attributes.media_content_id;
        }

        this._stationButtons.forEach(stationSwitch => {
            if (stationSwitch.hasAttribute('raised') && stationSwitch.stationUrl !== playingUrl) {
                stationSwitch.removeAttribute('raised');
                return;
            }
            if (!stationSwitch.hasAttribute('raised') && stationSwitch.stationUrl === playingUrl) {
                stationSwitch.setAttribute('raised', true);
            }
        })
    }

    buildStationSwitch(name, url) {
        const btn = document.createElement('mwc-button');
        btn.stationUrl = url;
        btn.className = 'juke-toggle';
        btn.innerText = name;
        // Update event listener to use onMediaSelect instead of onStationSelect.
        btn.addEventListener('click', this.onMediaSelect.bind(this));
        return btn;
    }

    onMediaSelect(e) {
        this.hass.callService('media_player', 'play_media', {
            entity_id: this._selectedSpeaker,
            media_content_id: e.currentTarget.stationUrl,
            media_content_type: 'audio/mp4'
        });
    }

    setVolume(value) {
        this.hass.callService('media_player', 'volume_set', {
            entity_id: this._selectedSpeaker,
            volume_level: value
        });
    }

    /***
     * returns the numeric index of the first entity in a "Playing" state, or 0 (first index).
     *
     * @param hass
     * @returns {number}
     * @private
     */
    findFirstPlayingIndex(hass) {
        return Math.max(0, this.config.entities.findIndex(entityId => {
            return hass.states[entityId] && hass.states[entityId].state === 'playing';
        }));
    }

    buildSpeakerSwitch(entityId, hass) {
        const entity = hass.states[entityId];

        const btn = document.createElement('paper-tab');
        btn.entityId = entityId;        
        btn.innerText = hass.states[entityId].attributes.friendly_name;
        return btn;
    }

    setConfig(config) {
        if (!config.entities) {
            throw new Error('You need to define your media player entities');
        }
        this.config = config;
    }

    getCardSize() {
        return 3;
    }
}

function getStyle() {
    const frag = document.createDocumentFragment();

    const included = document.createElement('style');
    included.setAttribute('include', 'iron-flex iron-flex-alignment');

    const ownStyle = document.createElement('style');
    ownStyle.innerHTML = `
    .layout.horizontal, .layout.vertical {
        display: -ms-flexbox;
        display: -webkit-flex;
        display: flex;
    }
    
    .layout.horizontal {
        -ms-flex-direction: row;
        -webkit-flex-direction: row;
        flex-direction: row;
    }
    
    .layout.center, .layout.center-center {
        -ms-flex-align: center;
        -webkit-align-items: center;
        align-items: center;
    }
    
    .flex {
        ms-flex: 1 1 0.000000001px;
        -webkit-flex: 1;
        flex: 1;
        -webkit-flex-basis: 0.000000001px;
        flex-basis: 0.000000001px;
    }
    
    [hidden] {
        display: none !important;
    }
    
    .volume {
        padding: 10px 20px;
    }
    
    mwc-button.juke-toggle {
        --mdc-theme-primary: var(--primary-text-color);
    }
    
    mwc-button.juke-toggle[raised] {
        --mdc-theme-primary: var(--primary-color);
        background-color: var(--primary-color);
        color: var(--text-primary-color);
    }
    
    paper-tabs {
        background-color: var(--primary-color);
        color: var(--text-primary-color);
        --paper-tabs-selection-bar-color: var(--text-primary-color, #FFF);
    }
    
    /* Custom overrides to make buttons and sliders white */
    paper-icon-button {
        color: white !important;
        --paper-icon-button-ink-color: white;
        --paper-icon-button-icon-color: white;
    }
    
    ha-paper-slider {
        --paper-slider-knob-color: white;
        --paper-slider-active-color: white;
        --paper-slider-pin-color: white;
        color: white;
    }
    
    /* Adjust sleep timer row (if needed) */
    .sleep-timer ha-paper-slider {
        --paper-slider-knob-color: white;
        --paper-slider-active-color: white;
    }
    `;
    frag.appendChild(included);
    frag.appendChild(ownStyle);
    return frag;
}

customElements.define('jukebox-card-ext', JukeboxCard);
